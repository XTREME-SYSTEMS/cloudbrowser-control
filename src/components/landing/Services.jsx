import React from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { serviceIcon, groupStyle } from "@/components/services/serviceIcons";

/**
 * The marketing section renders from the same catalogue the admin console
 * renders from, so the site can never advertise a capability the platform does
 * not carry — or miss one it does.
 */
export default function Services() {
  const { services, loading, error } = useServiceCatalog();

  return (
    <section id="services" className="py-20 lg:py-28 bg-[#faf8f3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            What We Do
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#0a1f3c] leading-tight">
            Production Services
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            {services.length} services, each run to the same standard: numbered steps, then an
            independent QA review, a compliance guardian and a separate-model validation before
            anything is delivered. Fees are quoted in advance and are never a percentage of your
            estate or recovery.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading services…
          </div>
        )}

        {error && !loading && (
          <p className="text-center text-sm text-slate-500">
            Our service list could not be loaded just now. Please use the quote form and we will send
            the current service sheet.
          </p>
        )}

        {!loading && !error && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => {
              const Icon = serviceIcon(s.icon);
              const style = groupStyle(s.group);
              return (
                <div
                  key={s.slug}
                  className="group flex flex-col rounded-xl p-7 bg-white border border-slate-200 hover:border-[#c9a961] hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#0a1f3c]/5 border border-[#0a1f3c]/10 flex items-center justify-center group-hover:bg-[#0a1f3c] group-hover:border-[#0a1f3c] transition-colors">
                      <Icon className="w-6 h-6 text-[#0a1f3c] group-hover:text-[#c9a961] transition-colors" />
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${style.chip}`}>
                      {s.group}
                    </span>
                  </div>

                  <h3 className="mt-5 font-serif text-xl font-semibold text-[#0a1f3c] mb-2">
                    {s.name}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.summary}</p>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-[#0a1f3c]">Typical range:</span>{" "}
                      {s.pricing.range.split(";")[0]}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CheckCircle2 className="w-3 h-3 text-[#c9a961]" />
                      {s.workflow.length} numbered steps, {s.agents.length} specialist agents
                    </p>
                    <ul className="pt-1 space-y-0.5">
                      {s.deliverables.slice(0, 3).map((d) => (
                        <li key={d} className="text-xs text-slate-500">
                          · {d}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to="/pricing"
                    className="mt-5 text-sm font-medium text-[#0a1f3c] group-hover:text-[#c9a961] transition-colors"
                  >
                    See the fee schedule →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}