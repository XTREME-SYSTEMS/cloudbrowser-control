import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const CHECKS = [
  { key: "gsc_submitted", label: "Google Search Console submitted" },
  { key: "sitemap_submitted", label: "Sitemap submitted to GSC" },
  { key: "robots_txt", label: "robots.txt configured" },
  { key: "meta_tags", label: "Meta tags (title + description)" },
  { key: "structured_data", label: "Structured data (JSON-LD)" },
  { key: "canonical_urls", label: "Canonical URLs" },
  { key: "https_enforced", label: "HTTPS enforced" },
  { key: "og_tags", label: "Open Graph tags" },
  { key: "twitter_cards", label: "Twitter Card tags" },
  { key: "favicon", label: "Favicon" },
  { key: "web_manifest", label: "Web App Manifest" },
  { key: "security_headers", label: "Security headers (CSP/HSTS)" },
];

export default function ComplianceReport({ report }) {
  if (!report) return null;

  const score = report.score || 0;
  const scoreColor = score >= 90 ? "#16A34A" : score >= 70 ? "#8A7300" : "#DC2626";

  return (
    <div className="xa-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#E5E7EB" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={scoreColor} strokeWidth="4"
              strokeDasharray={`${(score / 100) * 150.8} 150.8`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: scoreColor }}>{score}</div>
        </div>
        <div>
          <h3 className="font-heading font-bold text-base text-black">Google Compliance Report</h3>
          <p className="text-xs text-black/50">{score >= 90 ? "100% compliant from day 1" : score >= 70 ? "Mostly compliant — fix remaining items" : "Needs work before launch"}</p>
        </div>
      </div>

      {report.domain && (
        <div className="mb-3 p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
          <strong>Domain:</strong> {report.domain} {report.domain_purchased ? "✓ purchased" : "(pending purchase)"}
        </div>
      )}
      {report.production_url && (
        <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
          <strong>Production URL:</strong> {report.production_url}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CHECKS.map((c) => {
          const passed = report.compliance?.[c.key] || report[c.key];
          return (
            <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#E5E7EB]">
              {passed ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="text-xs text-black/70">{c.label}</span>
            </div>
          );
        })}
      </div>

      {report.errors && report.errors.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs font-bold text-red-700 mb-1">Errors:</p>
          {report.errors.map((e, i) => <p key={i} className="text-[10px] text-red-600">{e}</p>)}
        </div>
      )}
    </div>
  );
}