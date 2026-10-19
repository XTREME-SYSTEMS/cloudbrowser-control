import React, { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const searchTypes = [
  "Estate Search",
  "Trust Search",
  "Notice / Due Diligence",
  "Property / Title",
  "Class Action",
  "Pension Plan Participant",
  "Mass Tort Plaintiff",
  "Wrongful Death Heirs",
  "Other",
];

export default function QuoteCTA() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    caseType: "Estate Search",
    details: "",
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.details) {
      setError("Please fill in your name, email, and case details.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await base44.entities.Lead.create({
        form_type: "quotation",
        name: form.name,
        email: form.email,
        phone: form.phone,
        service: form.caseType,
        message: form.details,
        description: `Company: ${form.company || "N/A"}`,
      });
      setStatus("success");
      setForm({ name: "", email: "", phone: "", company: "", caseType: "Estate Search", details: "" });
    } catch (err) {
      setError("Something went wrong. Please try again or call us directly.");
      setStatus("error");
    }
  };

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (status === "success") {
    return (
      <section id="quote" className="py-20 lg:py-28 bg-[#0a1f3c] text-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#c9a961] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-serif text-3xl font-bold mb-4">Request Received</h2>
          <p className="text-slate-300 mb-8">
            Thank you for reaching out. One of our senior researchers will contact you
            within one business day to discuss your case and provide a transparent,
            non-percentage-based quote.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="px-6 py-3 rounded-lg bg-white text-[#0a1f3c] font-semibold hover:bg-slate-100 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="quote" className="py-20 lg:py-28 bg-[#0a1f3c] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, #c9a961 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }} />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
              Free Consultation
            </div>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold leading-tight mb-6">
              Contact Strategic Cloud Browser Today
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              Tell us about your case and receive a free, no-obligation consultation.
              Our reasonable fees are always quoted in advance — never a percentage of
              the estate.
            </p>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-200">Free initial consultation with a senior researcher</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-200">Transparent, non-percentage-based fee quote</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-200">Court-ready reports with sworn affidavits</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-200">Worldwide service across 65+ countries</span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-7 lg:p-8 text-slate-800 shadow-2xl"
          >
            <h3 className="font-serif text-2xl font-bold text-[#0a1f3c] mb-6">
              Request a Free Quote
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Full Name *
                </label>
                <input
                  value={form.name}
                  onChange={update("name")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c]"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c]"
                  placeholder="jane@firm.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={update("phone")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c]"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Company / Firm
                </label>
                <input
                  value={form.company}
                  onChange={update("company")}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c]"
                  placeholder="Doe Law Group"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Search Type
              </label>
              <select
                value={form.caseType}
                onChange={update("caseType")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c] bg-white"
              >
                {searchTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Case Details *
              </label>
              <textarea
                value={form.details}
                onChange={update("details")}
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#0a1f3c] resize-none"
                placeholder="Briefly describe the decedent, jurisdiction, and what you need located..."
              />
            </div>
            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#0a1f3c] text-white font-semibold hover:bg-[#1a3a5c] disabled:opacity-60 transition-colors"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Request Free Quote"
              )}
            </button>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Your information is never shared. Protected by reCAPTCHA.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}