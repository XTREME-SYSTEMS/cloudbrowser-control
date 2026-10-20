import React from "react";
import { CASES, GATE, SECTIONS, STATS } from "./mockData";

/**
 * OPTION 1 — Docket Rail.
 * One continuous paper dossier: a numbered docket rail on the left, and the
 * case read down a single sheet divided by rules instead of ten tabs.
 */
export default function DocketRailMock() {
  return (
    <div className="bg-[#faf8f3] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#c9a961]/50 pb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-heading text-[17px] font-bold text-[#0a1f3c]">Lucile C Wright</span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
            Pensacola, FL · Escambia
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#8a6f3a]">Not certified</span>
      </div>

      <div className="mt-4 grid grid-cols-[188px_1fr] gap-5">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">Docket</p>
          <ul>
            {CASES.map((c, i) => (
              <li
                key={c.id}
                className={`px-2 py-2 ${i === 0 ? "border-b-2 border-[#c9a961] bg-white" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-heading text-[11px] text-[#c9a961]">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0a1f3c]">{c.name}</span>
                </div>
                <p className="mt-0.5 pl-6 text-[10px] text-[#6b7280]">
                  {c.location} · {c.status}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-[#e5e2d8] pt-3">
            {STATS.slice(0, 4).map((s) => (
              <div key={s.label} className="flex items-baseline justify-between">
                <span className="text-[10px] text-[#6b7280]">{s.label}</span>
                <span className="font-heading text-[13px] font-bold tabular-nums text-[#0a1f3c]">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-l border-[#e5e2d8] pl-5">
          {SECTIONS.map((group) => (
            <section key={group.group} className="border-b border-[#e5e2d8] py-3 last:border-0">
              <h3 className="font-heading text-[13px] font-bold text-[#0a1f3c]">{group.group}</h3>
              <p className="mt-1 text-[11px] text-[#6b7280]">{group.items.join(" · ")}</p>
            </section>
          ))}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {GATE.map((g) => (
              <span key={g.label} className="text-[10px] uppercase tracking-[0.12em] text-[#8a6f3a]">
                {g.label}: {g.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}