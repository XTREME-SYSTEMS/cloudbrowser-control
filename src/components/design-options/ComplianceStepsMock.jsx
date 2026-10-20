import React from "react";
import { GATE, GAPS, SECTIONS } from "./mockData";

/**
 * OPTION 4 — Compliance Steps.
 * Organised around the authority the work was done under: the legal basis is
 * never off-screen, and the case is a strict numbered review ladder.
 */
const STEPS = [
  ...SECTIONS.map((s) => s.group),
  "Delivery",
];

export default function ComplianceStepsMock() {
  return (
    <div className="bg-white">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#d7dbe0] bg-[#f8fafc] px-5 py-2.5">
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#64748b]">Authority</span>
        <span className="text-[10px] text-[#0b1220]">
          Permissible purpose: <span className="font-semibold">probate / estate administration</span>
        </span>
        <span className="text-[10px] text-[#0b1220]">
          Matter: <span className="font-semibold">Escambia County estate file</span>
        </span>
        <span className="text-[10px] text-[#0b1220]">
          Data categories: <span className="font-semibold">public record only</span>
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d7dbe0] pb-3">
          <span className="text-[15px] font-bold text-[#0b1220]">Lucile C Wright</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#64748b]">
            Step 1 of 5 · Identity
          </span>
        </div>

        <ol>
          {STEPS.map((step, i) => (
            <li key={step} className="border-b border-[#d7dbe0] py-2.5 last:border-0">
              <div className="flex items-baseline gap-3">
                <span
                  className={`w-5 text-[11px] font-semibold tabular-nums ${
                    i === 0 ? "text-[#1e40af]" : "text-[#94a3b8]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      i === 0 ? "text-[#1e40af]" : "text-[#334155]"
                    }`}
                  >
                    {step}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#64748b]">
                    {i === 0
                      ? "Deceased identity not confirmed. No death record or obituary is attached, so no relationship above this step can be relied on."
                      : "Detailed as labelled key and value rows rather than cards."}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-3 rounded-md border border-[#d7dbe0] bg-[#f8fafc] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#64748b]">Outstanding</p>
          {GAPS.map((g) => (
            <p key={g} className="text-[10px] text-[#0b1220]">
              · {g}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d7dbe0] bg-[#fffbeb] px-5 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#92400e]">
          Blocked · {GATE.map((g) => g.value).join(" · ")}
        </span>
        <span className="rounded-md bg-[#1e40af] px-3 py-1 text-[10px] font-semibold text-white">
          Record decision
        </span>
      </div>
    </div>
  );
}