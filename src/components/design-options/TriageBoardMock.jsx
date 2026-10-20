import React from "react";
import { CASES, GAPS, SIGNALS, STATS } from "./mockData";

/**
 * OPTION 3 — Triage Board.
 * Leads with a ranked queue. Each row carries an actionability bar and the
 * distress signals, so the page answers what to work next before what a case says.
 */
const BAR = { c1: "w-1/3 bg-[#f59e0b]", c2: "w-2/3 bg-[#f59e0b]" };

export default function TriageBoardMock() {
  return (
    <div className="bg-[#f7f9fb] px-5 py-4">
      <div className="grid grid-cols-[1fr_240px] gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#334155]">
              Ranked by actionability
            </span>
            <span className="text-[10px] text-[#64748b]">2 of 214</span>
          </div>

          <ul className="space-y-1.5">
            {CASES.map((c, i) => (
              <li
                key={c.id}
                className={`rounded-md border bg-white px-3 py-2.5 ${
                  i === 0 ? "border-[#334155]/40" : "border-[#e2e8f0]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0f172a]">{c.name}</p>
                    <p className="text-[10px] text-[#64748b]">
                      {c.location} · owner search · {c.status}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#64748b]">RPC likelihood</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {SIGNALS.slice(0, i === 0 ? 4 : 2).map((s) => (
                    <span
                      key={s.label}
                      className={`rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] ${
                        s.tone === "amber"
                          ? "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#b45309]"
                          : "border-[#cbd5e1] bg-[#f1f5f9] text-[#475569]"
                      }`}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>

                <div className="mt-2 h-1.5 w-full rounded-full bg-[#e2e8f0]">
                  <div className={`h-1.5 rounded-full ${BAR[c.id]}`} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-[#e2e8f0] bg-white p-3">
          <p className="text-[11px] font-semibold text-[#0f172a]">Lucile C Wright</p>
          <p className="mb-2 text-[10px] text-[#64748b]">Pensacola, FL · partial</p>

          {["Subject", "Relationships", "Evidence", "Gate"].map((block, i) => (
            <div key={block} className="border-t border-[#e2e8f0] py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#334155]">
                  {block}
                </span>
                <span className="text-[10px] text-[#94a3b8]">{i === 0 ? "−" : "+"}</span>
              </div>
              {i === 0 && (
                <div className="mt-1.5 space-y-1">
                  {STATS.slice(0, 3).map((s) => (
                    <div key={s.label} className="flex justify-between text-[10px]">
                      <span className="text-[#64748b]">{s.label}</span>
                      <span className="tabular-nums text-[#0f172a]">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="mt-2 border-t border-[#e2e8f0] pt-2">
            {GAPS.slice(0, 2).map((g) => (
              <p key={g} className="text-[10px] text-[#b45309]">
                · {g}
              </p>
            ))}
          </div>

          <div className="mt-3 flex gap-2 border-t border-[#e2e8f0] pt-3">
            <span className="flex-1 rounded-md bg-[#334155] py-1.5 text-center text-[10px] font-semibold text-white">
              Approve
            </span>
            <span className="flex-1 rounded-md border border-[#cbd5e1] py-1.5 text-center text-[10px] font-semibold text-[#334155]">
              Reject
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}